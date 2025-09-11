export const msalConfig = {
  auth: {
    clientId: "4326c28f-89ab-43b6-a105-113be924f2fb",
    authority: "https://login.microsoftonline.com/2db96b99-3928-488f-9022-2fe14b729cee",
    redirectUri: "/"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  }
};

export const loginRequest = {
  scopes: ["User.Read"]
};
