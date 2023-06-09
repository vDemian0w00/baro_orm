"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.assertNever = assertNever;
exports.queryFailedGuard = void 0;
var _typeorm = require("typeorm");
// make the HandleRequest type req.user exists and is type User

function assertNever(value) {
  throw new Error("Unhandled discriminated union member: ".concat(JSON.stringify(value)));
}
var queryFailedGuard = function queryFailedGuard(err) {
  return err instanceof _typeorm.QueryFailedError;
};
exports.queryFailedGuard = queryFailedGuard;