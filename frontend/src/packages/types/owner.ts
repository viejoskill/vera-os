/** Owner (Propietario) domain type. Prepared for multiple owners per property in the future. */
export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
}
