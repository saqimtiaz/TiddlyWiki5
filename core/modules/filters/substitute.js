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
	var results = [],
		operands = Object.create(null);
	$tw.utils.each(operator.operands,function(operand,index){
		operands[(index + 1).toString()] = operand;
	});

	function substitute(str) {
		var widget = options.widget.makeFakeWidgetWithVariables(operands);
		var output = str.replace(/(?:\$\{([\S\s]+?)\}\$)|(?:\$\((\w+)\)\$)/g, function(match,filter,varname) {
			if(!!filter) {
				return options.wiki.filterTiddlers(filter,options.widget)[0] || "";
			} else if(!!varname) {
				return widget.getVariable(varname,{defaultValue: ""})
			}
		})
		return output;
	}
	
	source(function(tiddler,title) {
		if(title) {
			results.push(substitute(title));
		}
	});
	return results;
};

})();

/*
Questions:
	variable names for operands, just numeric or prefix with parameter, eg parameter1

*/