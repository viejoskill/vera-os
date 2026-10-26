/** Arma el texto de ubicación de una tarjeta/popup público: calle (si la propiedad la
 * tiene cargada) + barrio + localidad. Si `address` viene con el formato completo de
 * Google (calle, localidad, provincia, país), nos quedamos solo con la calle para no
 * repetir la localidad ni mostrar provincia/país de más. */
export const formatLocation = (address?: string | null, neighborhood?: string | null, city?: string | null) => {
  const street = (address || '').split(',')[0].trim();
  return [street, neighborhood, city].filter(Boolean).join(', ');
};
