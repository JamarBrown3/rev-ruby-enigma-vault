// Fail closed if the application accidentally receives broad infrastructure
// credentials again. Human Atlas ownership stays outside the application.
export function assertApplicationRoles(authInfo, dbName) {
  const roles = authInfo?.authenticatedUserRoles;
  if (!Array.isArray(roles) || roles.length !== 1 || roles[0].role !== "readWrite" || roles[0].db !== dbName) {
    const error = new Error("Application database privileges are not restricted.");
    error.code = "EXCESS_DATABASE_PRIVILEGES";
    throw error;
  }
}
