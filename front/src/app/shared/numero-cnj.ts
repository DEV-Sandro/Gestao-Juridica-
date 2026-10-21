export function formatarNumeroCnj(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 20);
  if (digitos.length !== 20) return valor;
  return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16)}`;
}

export function numeroCnjValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 20) return false;
  const base = digitos.slice(0, 7) + digitos.slice(9) + '00';
  let resto = 0;
  for (const digito of base) resto = (resto * 10 + Number(digito)) % 97;
  return 98 - resto === Number(digitos.slice(7, 9));
}
