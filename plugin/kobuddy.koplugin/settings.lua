local _ = require("gettext")
local DataStorage = require("datastorage")
local InfoMessage = require("ui/widget/infomessage")
local logger = require("logger")
local LuaSettings = require("luasettings")
local MultiInputDialog = require("ui/widget/multiinputdialog")
local UIManager = require("ui/uimanager")

local KobuddySettings = {
  settings = nil,
  data = nil,
}
KobuddySettings.__index = KobuddySettings

local SETTING_KEY = "kobuddy"
local DEFAULTS = {
  server_url = "",
  ingest_token = "",
  sync_on_suspend = false,
}

local function open_settings_handle()
  local path = DataStorage:getSettingsDir() .. "/" .. SETTING_KEY .. ".lua"
  return LuaSettings:open(path)
end

function KobuddySettings:new()
  local obj = setmetatable({}, self)
  obj.settings = open_settings_handle()
  local success, result = pcall(function()
    return obj.settings:readSetting(SETTING_KEY, {}) or {}
  end)
  if success then
    obj.data = result
  else
    logger.err("[kobuddy] Error reading settings:", result)
    obj.data = {}
  end
  return obj
end

function KobuddySettings:writeData()
  local success, error_msg = pcall(function()
    self.settings:saveSetting(SETTING_KEY, self.data)
    self.settings:flush()
    return true
  end)
  if not success then
    logger.err("[kobuddy] Error writing settings:", error_msg)
    return false
  end
  return true
end

function KobuddySettings:update(patch)
  for k, v in pairs(patch or {}) do
    self.data[k] = v
  end
  return self:writeData()
end

function KobuddySettings:getServerURL()
  return self.data.server_url or DEFAULTS.server_url
end

function KobuddySettings:setServerURL(url)
  url = tostring(url or ""):gsub("/*$", "")
  self:update({ server_url = url })
end

function KobuddySettings:getIngestToken()
  return self.data.ingest_token or DEFAULTS.ingest_token
end

function KobuddySettings:setIngestToken(token)
  self:update({ ingest_token = tostring(token or "") })
end

function KobuddySettings:getSyncOnSuspendEnabled()
  if self.data.sync_on_suspend == nil then
    return DEFAULTS.sync_on_suspend
  end
  return self.data.sync_on_suspend
end

function KobuddySettings:toggleSyncOnSuspend()
  local current = self:getSyncOnSuspendEnabled()
  local new_value = not current
  self:update({ sync_on_suspend = new_value })
  local message = new_value and _("Sync on suspend enabled") or _("Sync on suspend disabled")
  UIManager:show(InfoMessage:new({ text = message, timeout = 2 }))
  return new_value
end

function KobuddySettings:editServerSettings()
  self.settings_dialog = MultiInputDialog:new({
    title = _("kobuddy settings"),
    fields = {
      {
        text = self.data.server_url,
        description = _("Server URL:"),
        hint = _("http://your-host:3000"),
      },
      {
        text = self.data.ingest_token,
        description = _("Ingest token:"),
        hint = _("Bearer token from server env"),
      },
    },
    buttons = {
      {
        {
          text = _("Cancel"),
          id = "close",
          callback = function()
            UIManager:close(self.settings_dialog)
          end,
        },
        {
          text = _("Apply"),
          callback = function()
            local fields = self.settings_dialog:getFields()
            self:setServerURL(fields[1])
            self:setIngestToken(fields[2])
            UIManager:close(self.settings_dialog)
            UIManager:show(InfoMessage:new({ text = _("Settings saved."), timeout = 2 }))
          end,
        },
      },
    },
  })
  UIManager:show(self.settings_dialog)
  self.settings_dialog:onShowKeyboard()
end

return KobuddySettings
