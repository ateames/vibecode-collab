import { config as loadEnv } from "dotenv";
import { BOT_ACCOUNTS, type BotAccount } from "../src/db/schema.js";
import { LemmyPostingService } from "../src/services/lemmy-client.js";

loadEnv();

async function main() {
  const lemmy = new LemmyPostingService();
  const accounts = (process.argv[2]
    ? [process.argv[2] as BotAccount]
    : [...BOT_ACCOUNTS]) as BotAccount[];

  for (const botAccount of accounts) {
    await lemmy.saveUserSettingsAsBot(botAccount);
    console.log(`Marked ${botAccount} as bot_account=true`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
