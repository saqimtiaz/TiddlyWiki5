/*\
title: $:/core/modules/filters/substitute.js
type: application/javascript
module-type: filteroperator

Filter operator for substituting variables and embedded filter expressions with their corresponding values

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

/*
Export our filter function
*/
exports.substitute = function(source,operator,options) {
	var results = [];
	function substitute(str) {
		var output = str.replace(/\$\{([\S\s]+?)\}\$/g, function(match,filter) {
			return options.wiki.filterTiddlers(filter,options.widget)[0] || "";
		})   //check macro substitutions to see if returned values get processed even further
		.replace(/\$\((\w+)\)\$/g, function(match,varname) {
			return options.widget.getVariable(varname,{defaultValue: ""})
		})
		.replace(/\$(\d)\$/g, function(match,operandIndex) {  //assign operands as variables !!!
			var index = $tw.utils.parseInt(operandIndex) - 1;
			if(operator.operands[index]) {     
				return operator.operands[index];
			} else {
				return "";
			}
		});
		return(output);
	}
	
	source(function(tiddler,title) {
		if(title) {
			results.push(substitute(title));
		}
	});
	return results;
};

})();
