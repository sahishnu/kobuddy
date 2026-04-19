local _ = require("gettext")
local Dispatcher = require("dispatcher") -- luacheck:ignore
local InfoMessage = require("ui/widget/infomessage")
local logger = require("logger")
local KobuddyUpload = require("upload")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local KobuddySettings = require("settings")

local kobuddy = WidgetContainer:extend({
  name = "kobuddy",
  is_doc_only = false,
})

function kobuddy:init()
  self:onDispatcherRegisterActions()
  self.ui.menu:registerToMainMenu(self)
  self.kobuddy_settings = KobuddySettings:new({})
  self:initMenuOrder()
end

function kobuddy:addToMainMenu(menu_items)
  menu_items.kobuddy = {
    text = _("kobuddy"),
    sorting_hint = "tools",
    sub_item_table = {
      {
        text = _("Sync reading stats"),
        callback = function()
          self:performSync()
        end,
        separator = true,
      },
      {
        text = _("Sync on suspend"),
        checked_func = function()
          return self.kobuddy_settings:getSyncOnSuspendEnabled()
        end,
        callback = function()
          self.kobuddy_settings:toggleSyncOnSuspend()
        end,
      },
      {
        text = _("Server & token…"),
        keep_menu_open = true,
        callback = function()
          self.kobuddy_settings:editServerSettings()
        end,
      },
      {
        text = _("About kobuddy"),
        keep_menu_open = true,
        callback = function()
          local const = require("./const")
          UIManager:show(InfoMessage:new({
            text = "kobuddy — push reading stats to your server.\n\nPlugin version: "
              .. const.VERSION,
          }))
        end,
      },
    },
  }
end

function kobuddy:onDispatcherRegisterActions()
  Dispatcher:registerAction("kobuddy_sync", {
    category = "none",
    event = "KobuddySync",
    title = _("kobuddy: sync reading stats"),
    general = true,
  })
end

function kobuddy:onKobuddySync()
  self:performSync()
end

function kobuddy:performSync()
  local url = self.kobuddy_settings:getServerURL()
  local token = self.kobuddy_settings:getIngestToken()
  if not url or url == "" then
    UIManager:show(InfoMessage:new({ text = _("Server URL is not configured."), timeout = 3 }))
    return
  end
  if not token or token == "" then
    UIManager:show(InfoMessage:new({ text = _("Ingest token is not configured."), timeout = 3 }))
    return
  end

  local NetworkMgr = require("ui/network/manager")
  NetworkMgr:runWhenOnline(function()
    KobuddyUpload.syncCurrentBook(url, token, false)
  end)
end

function kobuddy:onSuspend()
  if not self.kobuddy_settings:getSyncOnSuspendEnabled() then
    return
  end
  local url = self.kobuddy_settings:getServerURL()
  local token = self.kobuddy_settings:getIngestToken()
  if not url or url == "" or not token or token == "" then
    return
  end
  if not self:isWiFiConnected() then
    return
  end
  local ok, err = pcall(function()
    KobuddyUpload.syncCurrentBook(url, token, true)
  end)
  if not ok then
    logger.err("[kobuddy] suspend sync failed:", err)
  end
end

function kobuddy:isWiFiConnected()
  local ok, result = pcall(function()
    local NetworkMgr = require("ui/network/manager")
    return NetworkMgr:isWifiOn() and NetworkMgr:isConnected()
  end)
  if not ok then
    return true
  end
  return result
end

function kobuddy:initMenuOrder()
  local menu_order_modules = {
    "ui/elements/filemanager_menu_order",
    "ui/elements/reader_menu_order",
  }
  for _, module_name in ipairs(menu_order_modules) do
    local success, menu_order = pcall(require, module_name)
    if success and menu_order and menu_order.tools then
      local pos = 1
      for i, val in ipairs(menu_order.tools) do
        if val == "statistics" then
          pos = i + 1
          break
        end
      end
      table.insert(menu_order.tools, pos, "kobuddy")
    end
  end
end

return kobuddy
