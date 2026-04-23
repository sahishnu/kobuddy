local socketutil = require("socketutil")
local ltn12 = require("ltn12")
local logger = require("logger")
local socket = require("socket")
local http = require("socket.http")
local UIManager = require("ui/uimanager")
local JSON = require("json")
local InfoMessage = require("ui/widget/infomessage")
local _ = require("gettext")

-- LuaSec (ssl.https) is required for HTTPS endpoints (e.g. Railway, Fly,
-- Render, or any server behind TLS). KOReader ships LuaSec, but guard the
-- require so the plugin still loads if it's unavailable on an older build.
local https_ok, https = pcall(require, "ssl.https")
if not https_ok then
  https = nil
end

local function pick_http_client(url)
  if type(url) == "string" and url:lower():match("^https://") then
    if not https then
      return nil, "HTTPS support (ssl.https / LuaSec) is not available in this KOReader build."
    end
    return https
  end
  return http
end

local function is_https_url(url)
  return type(url) == "string" and url:lower():match("^https://") ~= nil
end

local function response_not_valid(content)
  logger.err("[kobuddy] callApi: response was not valid JSON", content)
  UIManager:show(InfoMessage:new({
    text = _("Server response is not valid."),
  }))
end

local function try_decode_json(content)
  if type(content) ~= "string" or content == "" then
    return nil
  end
  local first = string.sub(content, 1, 1)
  if first ~= "{" and first ~= "[" then
    return nil
  end
  local ok, result = pcall(JSON.decode, content)
  if ok then
    return result
  end
  return nil
end

return function(method, url, headers, body, filepath, quiet)
  quiet = quiet or false

  local sink = {}
  local request = {
    method = method,
  }

  request.url = url
  request.headers = headers or {}

  request.sink = ltn12.sink.table(sink)
  socketutil:set_timeout(socketutil.LARGE_BLOCK_TIMEOUT, socketutil.LARGE_TOTAL_TIMEOUT)

  if body ~= nil then
    request.source = ltn12.source.string(body)
  end

  logger.dbg("[kobuddy] callApi:", request.method, request.url)

  local client, client_err = pick_http_client(request.url)
  if not client then
    logger.err("[kobuddy] callApi:", client_err)
    if not quiet then
      UIManager:show(InfoMessage:new({
        text = _(client_err),
      }))
    end
    socketutil:reset_timeout()
    return false, "https_unsupported"
  end

  -- LuaSec in KOReader sometimes ships without a usable CA bundle, which makes
  -- TLS handshakes fail against perfectly valid endpoints (Railway, Fly, etc.).
  -- For a self-hosted stats server this security tradeoff is acceptable: the
  -- data is already scoped to an opaque bearer token, and the user controls
  -- both ends. Connections are still encrypted; only cert validation is off.
  if is_https_url(request.url) then
    request.verify = "none"
    request.protocol = "any"
  end

  local code, resp_headers, status = socket.skip(1, client.request(request))
  socketutil:reset_timeout()

  -- Raise error if the socket / TLS layer failed before getting a response.
  -- LuaSocket surfaces the reason in `code` (e.g. "wrong version number",
  -- "certificate verify failed", "connection refused", "timeout").
  if resp_headers == nil then
    local reason = tostring(status or code or "unknown error")
    logger.err("[kobuddy] callApi: network error", reason, request.url)
    if not quiet then
      UIManager:show(InfoMessage:new({
        text = _("Network error: " .. reason),
      }))
    end
    return false, "network_error", reason
  end

  -- If the request returned successfully (any 2xx)
  local numeric_code = tonumber(code)
  if numeric_code and numeric_code >= 200 and numeric_code < 300 then
    local content = table.concat(sink)

    if content == nil or content == "" then
      response_not_valid(content)
      return false, "empty_response"
    end

    local result = try_decode_json(content)
    if result then
      return true, result
    end

    response_not_valid(content)
    return false, "invalid_response"
  else
    local content = table.concat(sink)
    local parsed = try_decode_json(content)
    local server_msg = parsed and (parsed.error or parsed.message) or nil

    if not quiet then
      local text = server_msg
          and ("Server error: " .. tostring(server_msg))
        or ("Server error (HTTP " .. tostring(status or code) .. ")")
      UIManager:show(InfoMessage:new({
        text = _(text),
      }))
    end

    logger.err("[kobuddy] callApi: HTTP error", status or code, server_msg)
    return false, parsed or "http_error", code
  end
end
