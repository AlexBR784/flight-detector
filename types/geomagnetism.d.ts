declare module 'geomagnetism' {
  export function model(date?: Date): { point(coordinates: number[]): { decl: number } };
}
