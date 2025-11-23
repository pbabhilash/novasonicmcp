"use strict";
/**
 * Nova Sonic server启动入口
 * 用于启动 WebSocket 服务器
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("./server");
console.log("Nova Sonic server started");
// 捕获未处理的异常和 Promise 拒绝
process.on("uncaughtException", (error) => {
    console.error("未捕获的异常:", error);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("未处理的 Promise 拒绝:", promise, "原因:", reason);
});
//# sourceMappingURL=server-cli.js.map