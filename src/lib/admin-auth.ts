/**
 * Centralized Admin Authorization Logic
 * 
 * This file defines the whitelisted UIDs and roles for administrative access.
 * Use these helpers to ensure consistent permissions across all admin modules.
 */

export const SUPER_ADMIN_EMAILS = [
  'simon@pezeka.com',
];

export const SUPER_ADMIN_UIDS = [
  'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2', // Simon
  'Z8gkNLZEVUWbsooR8R7OuHxApB62', // Admin 2
  'Xj9u0Yl6v0T1M5q9jR0k2l4m5n6o7p8q', // Admin 3 (if applicable)
];

/**
 * Checks if a user is a Super Admin based on UID or Email
 */
export const isSuperAdmin = (user: any): boolean => {
  if (!user) return false;
  
  const email = user.email?.toLowerCase()?.trim();
  const uid = user.uid;

  return (
    SUPER_ADMIN_EMAILS.includes(email) || 
    SUPER_ADMIN_UIDS.includes(uid)
  );
};

/**
 * Checks if a user has access to sensitive modules (Finance, KYC, Investors)
 * Access is granted to Super Admins and users with the 'finance' role.
 */
export const canAccessSensitiveModules = (user: any): boolean => {
  if (!user) return false;
  
  const role = user.role?.toLowerCase()?.trim();
  const email = user.email?.toLowerCase()?.trim() || '';
  
  return (
    isSuperAdmin(user) || 
    role === 'finance' || 
    email.endsWith('@finance.pezeka.com')
  );
};

/**
 * Checks if a user has access to basic staff modules (Loans, Customers, Applications)
 * Access is granted to Super Admins, 'finance' role, and 'staff' role.
 */
export const canAccessStaffModules = (user: any): boolean => {
  if (!user) return false;
  
  const role = user.role?.toLowerCase()?.trim();
  const email = user.email?.toLowerCase()?.trim() || '';
  
  return (
    isSuperAdmin(user) || 
    role === 'finance' || 
    role === 'staff' || 
    email.endsWith('@staff.pezeka.com') ||
    email.endsWith('@finance.pezeka.com')
  );
};
