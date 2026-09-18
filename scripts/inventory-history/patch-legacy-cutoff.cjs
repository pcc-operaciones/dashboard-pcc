// Apply only to an exported client legacy script; IDs remain outside this repository.
function patch(source){
 const signature='function calcularEdadFIFO(movTEX, movEU, invTEX, invEU) {';
 const clock='var hoy     = new Date().getTime();';
 if(source.split(signature).length!==2||source.split(clock).length!==2)throw Error('La función original cambió; revisar antes de aplicar.');
 return source.replace(signature,'function calcularEdadFIFO(movTEX, movEU, invTEX, invEU, fechaCorte) {').replace(clock,"var hoy     = fechaCorte ? new Date(fechaCorte + 'T00:00:00-05:00').getTime() : new Date().getTime();");
}
module.exports={patch};
if(require.main===module){const fs=require('fs');if(process.argv.length!==4)throw Error('Uso: node patch-legacy-cutoff.cjs original.gs salida.gs');fs.writeFileSync(process.argv[3],patch(fs.readFileSync(process.argv[2],'utf8')));}
