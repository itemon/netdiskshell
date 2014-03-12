/**
 * frankly speaking, nd.js behave as an intermediary between 
 * client and verious external script vendors
 * what we do here is separating script request from normal
 * static request and dispatching them to compatible third 
 * party script runtime, before we get started, we need you 
 * confirm 3 things preliminaryly:
 * 1) local php command line runtime is available
 * 2) local nodejs command line runtime is available
 * 3) make sure the 2 points above with a second thinking :)
 */
var Debugger = require("./debugger.js");
var d = new Debugger();
// /ppres/static/thirdparty/header/module_header.js
// D:\workshop\pui\static\thirdparty\header
/*d.onTranslatePath = function (url, codebase, pathname) {
	var prefix = "/ppres/static/thirdparty/header";
	if (pathname.indexOf(prefix) != -1) {
		var result = pathname.replace(prefix, "D:\\workshop\\pui\\static\\thirdparty\\header");
		console.log("\n*************************SPECIFIC PATH TRANSLATION*************************");
		console.log("\n[BEFORE]%s", url);
		console.log("\n[AFTER]%s", result);
		console.log("\n*************************SPECIFIC PATH TRANSLATION*************************");
		return result;
	}
	return null;
};*/
d.run();
