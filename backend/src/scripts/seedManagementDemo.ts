
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { Customer } from "../models/Customer";

const MANAGEMENT_EMAIL = "management@vaultbank.com";
const MANAGEMENT_PASSWORD = "Management@12345";

async function seedManagementDemo(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "This demo seed script must not run in production."
    );
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from the backend .env file.");
  }

  await mongoose.connect(mongoUri);

  try {
    const existing = await Customer.findOne({
      email: MANAGEMENT_EMAIL,
    }).select("+passwordHash");

    if (existing && existing.role !== "management") {
      throw new Error(
        `An account already exists for ${MANAGEMENT_EMAIL} with role "${existing.role}". ` +
        "No role changes were made. Inspect this account manually before proceeding."
      );
    }

    const passwordHash = await bcrypt.hash(
      MANAGEMENT_PASSWORD,
      12
    );

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.authProvider = "password";
      existing.status = "active";

      await existing.save();

      console.log("Existing management demo account password refreshed.");
    } else {
      await Customer.create({
        name: "Morgan Blake",
        email: MANAGEMENT_EMAIL,
        passwordHash,
        authProvider: "password",
        role: "management",
        kycStatus: "pending",
        status: "active",
        dailyLimitRupees: 50000,
      });

      console.log("Management demo account created successfully.");
    }

    console.log(`Email: ${MANAGEMENT_EMAIL}`);
    console.log(`Password: ${MANAGEMENT_PASSWORD}`);
    console.log("Development OTP will appear in the backend terminal.");
  } finally {
    await mongoose.disconnect();
  }
}

seedManagementDemo().catch((error: unknown) => {
  console.error("Management demo account setup failed:", error);
  process.exitCode = 1;
});
