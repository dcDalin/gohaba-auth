import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp(functions.config().firebase);

export const userSignUp = functions.auth.user().onCreate((user) => {
  const customClaims = {
    "https://hasura.io/jwt/claims": {
      "x-hasura-allowed-roles": ["user", "anonymous"],
      "x-hasura-default-role": "user",
      "x-hasura-user-id": user.uid,
    },
  };

  return admin.auth().setCustomUserClaims(user.uid, customClaims);
});
