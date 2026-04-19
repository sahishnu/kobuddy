local _ = require("gettext")
local callApi = require("call_api")
local InfoMessage = require("ui/widget/infomessage")
local JSON = require("json")
local KoInsightDbReader = require("db_reader")
local logger = require("logger")
local UIManager = require("ui/uimanager")
local const = require("./const")
local Device = require("device")

local API_UPLOAD_LOCATION = "/api/ingest/import"
local API_DEVICE_LOCATION = "/api/ingest/device"

local KobuddyUpload = {}

local function get_headers(body, token)
  local headers = {
    ["Content-Type"] = "application/json",
    ["Content-Length"] = tostring(#body),
    ["Authorization"] = "Bearer " .. token,
  }
  return headers
end

local function render_response_message(response, prefix, default_text)
  local text = prefix .. " " .. default_text
  if response ~= nil and response["message"] ~= nil then
    logger.dbg("[kobuddy] API message received: ", JSON.encode(response))
    text = prefix .. " " .. response["message"]
  end
  if response ~= nil and response["error"] ~= nil then
    text = prefix .. " " .. tostring(response["error"])
  end
  UIManager:show(InfoMessage:new({
    text = _(text),
  }))
end

function KobuddyUpload.send_device_data(server_url, token, silent)
  local url = server_url .. API_DEVICE_LOCATION
  local body = {
    id = G_reader_settings:readSetting("device_id"),
    model = Device.model,
    version = const.VERSION,
  }
  body = JSON.encode(body)

  local ok, response = callApi("POST", url, get_headers(body, token), body)

  if ok ~= true and not silent then
    render_response_message(response, "Error:", "Unable to register device.")
  end
end

function KobuddyUpload.send_statistics_data(server_url, token, silent)
  local url = server_url .. API_UPLOAD_LOCATION

  local body = {
    stats = KoInsightDbReader.progressData(),
    books = KoInsightDbReader.bookData(),
    version = const.VERSION,
  }

  body = JSON.encode(body)

  local ok, response = callApi("POST", url, get_headers(body, token), body)

  if not silent then
    if ok then
      render_response_message(response, "Success:", "Data uploaded.")
    else
      render_response_message(response, "Error:", "Data upload failed.")
    end
  end
end

function KobuddyUpload.syncCurrentBook(server_url, token, silent)
  if silent == nil then
    silent = false
  end
  if server_url == nil or server_url == "" then
    UIManager:show(InfoMessage:new({
      text = _("Please configure the server URL first."),
    }))
    return
  end
  if token == nil or token == "" then
    UIManager:show(InfoMessage:new({
      text = _("Please configure the ingest token."),
    }))
    return
  end

  KobuddyUpload.send_device_data(server_url, token, silent)
  KobuddyUpload.send_statistics_data(server_url, token, silent)
end

return KobuddyUpload
