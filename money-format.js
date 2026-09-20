/* Full Colombian peso amounts for labels, axes and tooltips. */
(function(root){
'use strict';
const formatter=new Intl.NumberFormat('es-CO',{minimumFractionDigits:0,maximumFractionDigits:2});
function format(value){return typeof value==='number'&&Number.isFinite(value)?'$ '+formatter.format(value):'—';}
const api={format};root.PccMoney=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
