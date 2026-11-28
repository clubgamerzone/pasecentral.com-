type Permissions = {
  admin: boolean;
  manage: string[];
  sell: string[];
  access: string[];
};

export function landingPage(permissions: Permissions) {
  if (permissions.admin || permissions.manage.length) return "/admin";
  if (permissions.sell.length) return "/box-office";
  if (permissions.access.length) return "/access";
  return "/account/tickets";
}
