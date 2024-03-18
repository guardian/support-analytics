import "source-map-support/register";
import { GuRoot } from "@guardian/cdk/lib/constructs/root";
import { Bandit } from "../lib/bandit";

const app = new GuRoot();
new Bandit(app, "Bandit-euwest-1-CODE", { stack: "deploy", stage: "CODE", env: { region: "eu-west-1" } });
new Bandit(app, "Bandit-euwest-1-PROD", { stack: "deploy", stage: "PROD", env: { region: "eu-west-1" } });
