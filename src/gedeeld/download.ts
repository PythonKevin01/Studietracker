/** Laat de browser een bestand opslaan. */
export function downloadBestand(naam: string, inhoud: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([inhoud], { type }));
  a.download = naam;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
