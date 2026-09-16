/**
 * Helper de validación y formateo de RUT chileno
 */

export function cleanRut(rut) {
  if (!rut) return '';
  return String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
}

export function formatRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return cleaned;
  
  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  
  let cuerpoFormateado = '';
  let i = cuerpo.length;
  let count = 0;
  
  while (i--) {
    count++;
    cuerpoFormateado = cuerpo.charAt(i) + cuerpoFormateado;
    if (count % 3 === 0 && i !== 0) {
      cuerpoFormateado = '.' + cuerpoFormateado;
    }
  }
  
  return `${cuerpoFormateado}-${dv}`;
}

export function validateRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 8 || cleaned.length > 9) return false;
  
  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  
  let suma = 0;
  let multiplo = 2;
  
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  
  const dvEsperadoNum = 11 - (suma % 11);
  let dvEsperado = '';
  
  if (dvEsperadoNum === 11) dvEsperado = '0';
  else if (dvEsperadoNum === 10) dvEsperado = 'K';
  else dvEsperado = String(dvEsperadoNum);
  
  return dv === dvEsperado;
}