/**
 * test request
 */

var isObjNotArray = function (util, o) {
	return (o && (typeof o == "object") && !util.isArray(o));
};

var merge = function (util, sup, sub) {
	var itemSub = null;
	var itemSup = null;
	for (var p in sub) {
		if (sub.hasOwnProperty(p)) {
			itemSub = sub[p];
			itemSup = sup[p];
			if (isObjNotArray(itemSub) 
					&& isObjNotArray(itemSup)) {
				merge(itemSup, itemSub);
			} else if (isObjNotArray(itemSub) 
					|| isObjNotArray(itemSup)) {
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

var util = require("util");
var a = {
	a : 1,
	b : 2,
	c : 3,
	d : {
		x : 1
	}
};
var b = {
	a : 1,
	b : 100,
	d : {
		x : 1000
	}
};
console.log(util.inspect(a, true), util.inspect(b, true));
merge(util, a, b);
console.log(util.inspect(a, true), util.inspect(b, true));

