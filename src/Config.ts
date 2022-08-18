export const Config = {
  Version: "0.1.0",
  ScriptExtensions: [".js"],
  EmbededScriptExtensions: [".ejs"],
  SessionCookie: "__NODE_SESSION__",
  SessionTimeOut: 15 * 60,
  SessionPath: process.env.SESSION_PATH || "D:/Programs/nodejs/sessions"
};
