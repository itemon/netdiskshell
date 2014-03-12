/**
 * the alleged local debugger
 */
var LocalDebugger = function () {
	// private members
	this._mConf = null;
	// urlParser
	this._mUrlParser = require("url");
};
LocalDebugger.CONF = "./conf.json";
LocalDebugger.LOG_ERR = "./";

LocalDebugger.KEY_BOOT_SCRIPT = "boot_script";
LocalDebugger.KEY_CODE_BASE = "code_base";
LocalDebugger.KEY_CODE_TPL_BASE = "code_tpl_base";

LocalDebugger.PATTERN_STATIC_PREFIX = /^\/(res|ppres)/gi;
LocalDebugger.PATTERN_TPL = /dataview\.initialize\(({.+})/gi;

LocalDebugger.DEBUG = false;

LocalDebugger.isObjNotArray = function (util, o) {
	return (o && (typeof o == "object") && !util.isArray(o));
};
/**
 * merge
 * @param util
 * @param sup
 * @param sub
 */
LocalDebugger.merge = function (util, sup, sub) {
	var itemSub = null;
	var itemSup = null;
	for (var p in sub) {
		if (sub.hasOwnProperty(p)) {
			itemSub = sub[p];
			itemSup = sup[p];
			if (LocalDebugger.isObjNotArray(util, itemSub) 
					&& LocalDebugger.isObjNotArray(util, itemSup)) {
				LocalDebugger.merge(util, itemSup, itemSub);
			} else if (LocalDebugger.isObjNotArray(util, itemSub) 
					|| LocalDebugger.isObjNotArray(util, itemSup)) {
				// abort
			} else {
				var typeSub = typeof itemSub;
				var typeSup = typeof itemSup;
				if (typeSub === typeSup && typeSub != undefined) {
					// merged
					sup[p] = itemSub;
				}
			}
		}
	}
};

LocalDebugger.prototype = {
	run : function () {
		this._conf();
	},
	logError : function (msg, tag) {
		var fs = require("fs"), 
			util = require("util"),
			tag = tag || "Untyped",
			time = new Date(),
			path = require("path");
		
		var dir = this._mConf.log.err || LocalDebugger.LOG_ERR;
		var file = path.join(dir, util.format("err_%s-%s-%s", time.getFullYear(), time.getMonth()+1, time.getDate()));
		msg = util.format("[%s]%s, %s", tag, msg, time.toLocaleString());
		fs.writeFile(file, msg, {encoding:"utf8",flags:'a+'}, function () {
		});
	},
	_conf : function () {
		var fs = require("fs"),
			_this = this;
		fs.readFile(LocalDebugger.CONF, function (err, data) {
			if (err) {
				if (LocalDebugger.DEBUG)console.error("[HttpServerBootFailed]%s", "conf file missing");
			} else {
				try {
					if (LocalDebugger.DEBUG)console.log("conf: %s", data);
					_this._mConf = JSON.parse(data);
					// check conf availability
					// 1: BOOT_SCRIPT
					var path = _this._mConf[LocalDebugger.KEY_BOOT_SCRIPT];
					fs.exists(path, function (exists) {
						if (exists) {
							_this._prepareServer();
						} else {
							if (LocalDebugger.DEBUG)console.error("[HttpServerBootFailed]%s", "boot script missing");
						}
					});
				} catch (e) {
					if (LocalDebugger.DEBUG)console.error("[HttpServerBootFailed]%s", e);
				}
			}
		});
	},
	_route : function (req, resp) {
		if (LocalDebugger.DEBUG)console.log("[%s]http request", req.url);
		// separate static file request from api request
		// TODO how to do it
		
		// parse path info
		var url = require("url");
		var urlInfo = url.parse(req.url);
		var urlPathName = urlInfo.pathname;
		if (LocalDebugger.DEBUG)console.log("request path %s", urlPathName);
		var map = this._mConf.app.page;
		var apiMap = this._mConf.app.api;
		var _this = this;
		
		if (urlPathName.trim().length > 0 
				&& typeof map[urlPathName] != "undefined") {
			var fileInfo = map[urlPathName];
			this._php(req, resp, 
					fileInfo[0] + fileInfo[1], 
					urlPathName,
					urlInfo.path);
			return true;
		} else if (urlPathName.trim().length > 0 
				&& typeof apiMap[urlPathName] != "undefined") {
			var info = apiMap[urlPathName];
			var drop = this._mConf.enable_rnd_api_drop ? 
					Math.random() * 100 % 4 == 0 : false;
			// fast drop
			if (drop || info[0] === "drop") {
				this._printe(resp, {code:500}, "intensionally dropping, rnd:" + drop);
			} else {
				this._parseRemoteTplData(apiMap, req, resp, urlInfo.path, function(tplData) {
					_this._printj(resp, tplData);
				});
			}
			return true;
		} else {
			return false;
		}
	},
	_getCookie : function (cookie) {
		var c = require("util").format(
				"LITE_DEBUG=model; %s", cookie);
//		console.log("compose cookie: %s", c);
		return c;
	},
	_parseRemoteTplData : function (tplMap, req, resp, path, callback) {
		var http = require("http"),
			_this = this,
			isTplPage = (tplMap === this._mConf.app.page),
			cookie = isTplPage ? _this._getCookie(req.headers["cookie"]) : req.headers["cookie"],
			chunk = "";
		console.log("send request to: %s", path);
		http.get({
			"host" : this._mConf.app.remote_host,
			"path" : path,
			"headers" : {
				"cookie" : cookie,
				"user-agent" : "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.72 Safari/537.36",
				"host" : this._mConf.app.remote_host
			}
		}, function(resp) {
			resp.setEncoding("utf8");
			resp.on("data", function (data) {
				chunk += data;
			});
			resp.on("end", function () {
				var json = isTplPage ? _this.onFormatTplData(chunk, true) : chunk;
				_this._mergeFromLocal(tplMap, req, resp, json, callback);
			});
		}).on("error", function (e) {
			console.error(e.message);
			_this._mergeFromLocal(tplMap, req, resp, null, callback);
		});
	},
	onFormatTplData : function (data, tpl) {
		LocalDebugger.PATTERN_TPL.lastIndex = 0;
		var jsonStr = data;
		if (LocalDebugger.PATTERN_TPL.test(data)) {
			var script = RegExp.$1;
			var lastForwardBrace = script.lastIndexOf("{");
			var token = script.substring(0, lastForwardBrace - 1);
			return token;
		} else {
			if (LocalDebugger.DEBUG)console.warn("not matched: ", data);
		}
		return jsonStr;
	},
	_mergeFromLocal : function (tplMap, req, resp, remoteData, callback) {
		// local dict
		var path = require("url").parse(req.url).pathname;
		var map = tplMap;
		var localFound = false;
		var _this = this;
		if (typeof map[path] != "undefined") {
			var conf = map[path];
			if (conf.length > 2) {
				var localFile = conf[2];
				localFound = true;
				var fs = require("fs");
				fs.readFile(localFile, {encoding:"utf8",flag:"r"}, function (err, data) {
					if (err) {
						if (remoteData == null) {
							_this._printe(resp, {code:404}, "can not resolve template data, " +
									"both remote server and local file is not available");
						} else {
							if (LocalDebugger.DEBUG)console.log("resolve with remote data");
							callback.call(_this, remoteData);
						}
					} else {
						if (LocalDebugger.DEBUG)console.log("\nlocal: %s", data);
						remoteData = _this._mix(remoteData, data);
						if (LocalDebugger.DEBUG)console.log("\nmix: %s++++%s", remoteData, typeof remoteData);
						callback.call(_this, remoteData);
					}
				});
			}
		}
		if (!localFound) {
			if (remoteData == null) {
				_this._printe(resp, {code:404}, "can not resolve template data, " +
						"both remote server and local file is not available");
			} else {
				callback.call(_this, remoteData);
			}
		}
	},
	_mix : function (defaultData, supersedeData) {
		var json = null;
		try {
			json = JSON.parse(defaultData);
		} catch (e) {}
		
		if (json == null) {
			// looks like remote data is crash
			// return local data with high priority
			if (supersedeData) {
				try {
					var localJson = JSON.parse(supersedeData);	
					return JSON.stringify(localJson);
				} catch (e) {}
			}
			return supersedeData;
		} else {
			var localJson = null;
			try {
				localJson = JSON.parse(supersedeData);
			} catch (e) {}
			if (localJson == null) {
				// local data is crash
				// nevertheless, use remote
				return defaultData;
			} else {
				// plugin localJson into json
				// is heavy move, let do it
				LocalDebugger.merge(
						require("util"), json, localJson);
				return JSON.stringify(json);
			}
		}
	},
	_quote : function (data) {
		data = data.replace(/"/gi, "\\\"");
		return "\""+data+"\"";
	},
	_php : function (req, resp, fileInfo, pathname, pathAndQuery) {
		var process = require("child_process"),
			_this = this;
		
		this._parseRemoteTplData(this._mConf.app.page, req, resp, pathAndQuery, function(tplData) {
			if (LocalDebugger.DEBUG)console.log("tplData: ", tplData);
			var path = _this._mConf[LocalDebugger.KEY_BOOT_SCRIPT];
			var util = require("util");
			var cmd = util.format("php %s %s %s %s %s", 
					path, // boot script of debug
					_this._mConf[LocalDebugger.KEY_CODE_BASE], // argv[1]=> code_base
					_this._mConf[LocalDebugger.KEY_CODE_TPL_BASE], // argv[2] => code_tpl_base
					fileInfo, // argv[3] => tpl_path + tpl_name
					_this._quote(tplData), // argv[4] => template data
					null // argv[5] => http cookie
					);
			
			/*if (LocalDebugger.DEBUG)*/console.log("cmd=%s", cmd);
			process.exec(cmd, function (err, stdout, stderr) {
				if (err) {
					_this._printe(resp, err, "php script error, have you forgot build template?");
					_this.logError("execute php failed: " + pathAndQuery, "PHP");
				} else {
					_this._printd(resp, stdout);
				}
			});
		});
	},
	_printj : function (resp, stdout) {
		resp.writeHead(200, {"content-type":"application/json;charset=utf8"});
		resp.write(stdout);
		resp.end();
	},
	_printd : function (resp, stdout) {
		resp.writeHead(200, {"content-type":"text/html;charset=utf8"});
		resp.write(stdout);
		resp.end();
	},
	_printe : function (resp, err, stderr) {
		var util = require("util");
		if (LocalDebugger.DEBUG)console.log("[HttpRequestFailed%s", 
				util.inspect(err, true));
		resp.writeHead(err.code, {
			"content-type":"text/plain;charset=utf8"
		});
		resp.write(util.format("http status: %d\n", err.code));
		resp.write(util.format("description: %s\n", stderr));
		resp.end();
	},
	/**
	 * siginificant important path translation callback,
	 * concrete project should provide project-specific translation
	 * @param url
	 * @param codebase
	 * @param pathname
	 * @returns path if hit specific map strategy, null otherwise
	 */
	onTranslatePath : function (url, codebase, pathname, supposedPath) {
		var map = this._mConf.app.static_rewrite_rules,
			item = null,
			prefix = null,
			result = null;
		
		// fast reject
		if (map.length == 0)
			return null;
		
		for (var i = 0, len = map.length; i < len; i++) {
			item = map[i];
			prefix = item.from;
			if (pathname.indexOf(prefix) != -1) {
				if (item.mode === "switch") {
					result = pathname.replace(prefix, item.to);
				} else if (item.mode === "replace") {
					result = supposedPath.replace(prefix, item.to);
				} else {
					result = supposedPath;
				}
				if (LocalDebugger.DEBUG)console.log("\n*************************SPECIFIC PATH TRANSLATION*************************");
				if (LocalDebugger.DEBUG)console.log("\n[BEFORE]%s", url);
				if (LocalDebugger.DEBUG)console.log("\n[AFTER]%s", result);
				if (LocalDebugger.DEBUG)console.log("\n*************************SPECIFIC PATH TRANSLATION*************************");
				return result;
			}
		}
		return null;
	},
	_prepareServer : function () {
		var http = require('http'),
			_this = this,
			staticServer = require("node-static"),
			port = this._mConf.local_port || 8087;
		
		var fileServer = new staticServer.Server(null, { 
			cache: 600, 
			headers: { 'X-Powered-By': 'node-static' } 
		});
		http.createServer(function (req, resp) {
			var handled = _this._route(req, resp);
			if (!handled) {
				fileServer.resolve = function (pathname) {
					return pathname;
				};
				var staticPattern = LocalDebugger.PATTERN_STATIC_PREFIX;
				staticPattern.lastIndex = 0;
				if (staticPattern.test(req.url)) {
					var info = _this._mUrlParser.parse(req.url);
					var pathname = info.pathname;
					var translatePath = null;
					var physicPath = _this._mConf.code_base + pathname.replace(staticPattern, "");
					if ((translatePath = _this.onTranslatePath(req.url, _this._mConf.code_base, pathname, physicPath)) != null) {
						physicPath = translatePath;
					}
					if (LocalDebugger.DEBUG)console.log("[LOG]%s", physicPath);
					fileServer.serveFile(physicPath, 200, {}, req, resp)
					.addListener('error', function (err) {
					    _this._printe(resp, {code:404}, "not found: " + err);
					});
				} else {
					_this._printe(resp, {code:404}, 
							"permission denied for " + req.url);
				}
			}
		}).listen(port);
		console.log("http server is watching at port %d", port);
	}
};
module.exports = LocalDebugger;