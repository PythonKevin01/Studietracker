// Modules die de build aanmaakt (zie vite.config.ts). Het type wordt in
// src/gedeeld/curriculum.ts vastgelegd.
declare module 'virtual:curriculum' {
  const curriculum: unknown;
  export default curriculum;
}

declare module 'virtual:publieke-sleutels' {
  const sleutels: unknown;
  export default sleutels;
}
