import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

admin.initializeApp(functions.config().firebase);

type Maybe<T> = T | null;

type UserProfileArgs = {
  email?: Maybe<string>;
  id?: Maybe<string>;
  displayName?: Maybe<string>;
};

const HASURA_OPERATION = `
  mutation MyMutation($email: String = "", $id: String = "", $displayName: String = "") {
    insert_users_one(object: {email: $email, id: $id, displayName: $displayName}) {
      id
    }
  }
`;

const execute = async (variables: UserProfileArgs): Promise<any> => {
  const fetchResponse = await fetch(
    "https://dev-gohaba.hasura.app/v1/graphql",
    {
      headers: {
        "x-hasura-role": "anonymous",
      },
      method: "POST",
      body: JSON.stringify({
        query: HASURA_OPERATION,
        variables,
      }),
    }
  );
  const data = await fetchResponse.json();
  console.log("DEBUG: ", data);
  return data;
};

export const userSignUp = functions.auth.user().onCreate(async (user) => {
  const { email, uid, displayName } = user;

  let customClaims;

  if (user.email && user.email === "mcdalinoluoch@gmail.com") {
    customClaims = {
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": ["user", "anonymous"],
        "x-hasura-default-role": "user",
        "x-hasura-user-id": user.uid,
        admin: true,
        accessLevel: 9,
      },
    };
  } else {
    customClaims = {
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": ["user", "anonymous"],
        "x-hasura-default-role": "user",
        "x-hasura-user-id": user.uid,
      },
    };
  }

  try {
    await admin.auth().setCustomUserClaims(user.uid, customClaims);

    // execute the Hasura operation
    const { errors } = await execute({ email, id: uid, displayName });

    // if Hasura operation errors, then throw error
    if (errors) {
      await admin.auth().deleteUser(uid);
      functions.logger.error("Hasura errors: ", errors);
      throw new Error(errors);
    }
    functions.logger.info("New user created: ", email);

    // Update real-time database to notify client to force refresh.
    const metadataRef = admin.database().ref("/metadata/" + user.uid);

    // Set the refresh time to the current UTC timestamp.
    // This will be captured on the client to force a token refresh.
    return metadataRef.set({ refreshTime: new Date().getTime() });
  } catch (error) {
    console.error({ error });
  }
});
