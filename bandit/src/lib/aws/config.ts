export const stage = (process.env.STAGE ?? "PROD") as "DEV" | "CODE" | "PROD";
export const region = "eu-west-1";
export const namespace = `support-bandit-${stage}`;
