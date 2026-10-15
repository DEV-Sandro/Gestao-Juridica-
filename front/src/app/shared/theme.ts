export type AppTheme = 'light' | 'dark';

export function aplicarTema(valor: string | null): AppTheme {
  const tema: AppTheme = valor === 'dark' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', tema);
  document.documentElement.style.colorScheme = tema;
  localStorage.setItem('justapro-theme', tema);
  return tema;
}
