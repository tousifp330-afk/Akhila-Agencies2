import { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './auth';

const ADMIN_EMAIL = 'tousifp330@gmail.com';

const AdminContext = createContext<{ isAdmin: boolean }>({ isAdmin: false });

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  return (
    <AdminContext.Provider value={{ isAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
