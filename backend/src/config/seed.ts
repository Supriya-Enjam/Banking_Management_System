import bcrypt from "bcryptjs";
import { Customer } from "../models/Customer";
import { BankAccount } from "../models/BankAccount";
import { Transaction } from "../models/Transaction";
import { Beneficiary } from "../models/Beneficiary";
import { Loan } from "../models/Loan";
import { FixedDeposit } from "../models/FixedDeposit";
import { Notification } from "../models/Notification";
import { AuditLog } from "../models/AuditLog";

export async function seedInitialData(): Promise<void> {
  try {
        console.log("🌱 Seeding initial demo data for VaultBank...");

    const passwordHash = await bcrypt.hash("Admin@12345", 10);
    const demoPasswordHash = await bcrypt.hash("Demo@12345", 10);
    const staffPasswordHash = await bcrypt.hash("Staff@12345", 10);
    const managementPasswordHash = await bcrypt.hash("Management@12345", 10);
    const sarahPasswordHash = await bcrypt.hash("Sarah@12345", 10);

    // 1. Create Admin only if missing
    let admin = await Customer.findOne({
      email: "admin@vaultbank.com",
    });

    if (!admin) {
      admin = await Customer.create({
        name: "Victoria Sterling",
        employeeId: "VB-EMP-1003",
        email: "admin@vaultbank.com",
        passwordHash,
        role: "admin",
        phone: "+91 99887 76655",
        address: "VaultBank Towers, Financial Expressway, Mumbai",
        kycStatus: "verified",
        dailyLimitRupees: 500000,
        status: "active",
      });
    }

    if (admin && !admin.employeeId) {
  admin.employeeId = "VB-EMP-1003";
  await admin.save();
}

    // 2. Create Staff only if missing
    let staff = await Customer.findOne({
      email: "staff@vaultbank.com",
    });

    if (!staff) {
      staff = await Customer.create({
        name: "Arthur Vance",
        employeeId: "VB-EMP-1001",
        email: "staff@vaultbank.com",
        passwordHash: staffPasswordHash,
        role: "staff",
        phone: "+91 98112 23344",
        address: "VaultBank Operations Hub, Bandra-Kurla Complex",
        kycStatus: "verified",
        dailyLimitRupees: 200000,
        status: "active",
      });
    }

    if (staff && !staff.employeeId) {
  staff.employeeId = "VB-EMP-1001";
  await staff.save();
}

    
    
    // 3. Create or update Management
    let management = await Customer.findOne({
      email: "management@vaultbank.com",
    });

    if (!management) {
      management = await Customer.create({
        name: "VaultBank Management",
        employeeId: "VB-EMP-1002",
        email: "management@vaultbank.com",
        passwordHash: managementPasswordHash,
        role: "management",
        phone: "+91 98000 12345",
        address: "VaultBank Management Office, Mumbai",
        kycStatus: "verified",
        dailyLimitRupees: 200000,
        status: "active",
      });
    } else {
      management.name = "VaultBank Management";
      management.passwordHash = managementPasswordHash;
      management.role = "management";
      management.status = "active";
      management.authProvider = "password";
    }

    if (!management.employeeId) {
      management.employeeId = "VB-EMP-1002";
    }

    await management.save();



    // 3. Create Demo Customer (Update if exists or create)
    let customer = await Customer.findOne({ email: "demo.customer@example.com" });
    if (!customer) {
      customer = await Customer.create({
        name: "Alexander Morgan",
        email: "demo.customer@example.com",
        passwordHash: demoPasswordHash,
        role: "customer",
        phone: "+91 98765 43210",
        address: "74 Silicon Avenue, Tech Park, Bangalore",
        kycStatus: "verified",
        dailyLimitRupees: 100000,
        status: "active",
      });
    } else {
      customer.role = "customer";
      customer.name = "Alexander Morgan";
      customer.kycStatus = "verified";
      customer.passwordHash = demoPasswordHash;
      await customer.save();
    }

    // 4. Create Sarah Smith
    let sarah = await Customer.findOne({ email: "sarah.smith@example.com" });
    if (!sarah) {
      sarah = await Customer.create({
        name: "Sarah Smith",
        email: "sarah.smith@example.com",
        passwordHash: sarahPasswordHash,
        role: "customer",
        phone: "+91 98450 12345",
        address: "18 Orchard Heights, Pune",
        kycStatus: "verified",
        dailyLimitRupees: 75000,
        status: "active",
      });
    }

    // 5. Create Pending KYC Customer
    let rajesh = await Customer.findOne({ email: "rajesh.kumar@example.com" });
    if (!rajesh) {
      rajesh = await Customer.create({
        name: "Rajesh Kumar",
        email: "rajesh.kumar@example.com",
        passwordHash: demoPasswordHash,
        role: "customer",
        phone: "+91 91234 56789",
        address: "9 Ring Road, New Delhi",
        kycStatus: "pending",
        dailyLimitRupees: 25000,
        status: "active",
      });
    }

    // Accounts for Alexander Morgan
    let primaryAccount = await BankAccount.findOne({ customerId: customer._id, accountType: "savings" });
    if (!primaryAccount) {
      primaryAccount = await BankAccount.create({
        customerId: customer._id,
        accountNumber: "VB1002003001",
        accountType: "savings",
        balancePaise: 12500000, // ₹125,000.00
        dailyLimitPaise: 10000000, // ₹100,000.00
        status: "active",
      });
    } else {
      primaryAccount.balancePaise = Math.max(primaryAccount.balancePaise, 12500000);
      await primaryAccount.save();
    }

    let businessAccount = await BankAccount.findOne({ customerId: customer._id, accountType: "business" });
    if (!businessAccount) {
      businessAccount = await BankAccount.create({
        customerId: customer._id,
        accountNumber: "VB1002003002",
        accountType: "business",
        balancePaise: 48500000, // ₹485,000.00
        dailyLimitPaise: 50000000, // ₹500,000.00
        status: "active",
      });
    }

    // Account for Sarah Smith
    let sarahAccount = await BankAccount.findOne({ customerId: sarah._id });
    if (!sarahAccount) {
      sarahAccount = await BankAccount.create({
        customerId: sarah._id,
        accountNumber: "VB2004006001",
        accountType: "savings",
        balancePaise: 8400000, // ₹84,000.00
        dailyLimitPaise: 10000000,
        status: "active",
      });
    }

    // Seed Beneficiaries for Alexander Morgan
    const benCount = await Beneficiary.countDocuments({ customerId: customer._id });
    if (benCount === 0) {
      await Beneficiary.create([
        {
          customerId: customer._id,
          name: "Sarah Smith",
          accountNumber: sarahAccount.accountNumber,
          bankName: "VaultBank",
          ifscCode: "VAULT000108",
          nickname: "Sarah Work Partner",
          maxLimitRupees: 50000,
        },
        {
          customerId: customer._id,
          name: "Rahul Sharma",
          accountNumber: "HDFC0982341234",
          bankName: "HDFC Bank",
          ifscCode: "HDFC0001234",
          nickname: "Rahul Landlord",
          maxLimitRupees: 40000,
        },
        {
          customerId: customer._id,
          name: "Priya Patel",
          accountNumber: "ICIC0019283746",
          bankName: "ICICI Bank",
          ifscCode: "ICIC0005678",
          nickname: "Priya Family",
          maxLimitRupees: 25000,
        },
      ]);
    }

    // Seed sample transactions if none
    const txnCount = await Transaction.countDocuments({ accountId: primaryAccount._id });
    if (txnCount < 3) {
      await Transaction.create([
        {
          accountId: primaryAccount._id,
          reference: "VB-TXN-INIT-DEP",
          type: "deposit",
          category: "Deposit",
          amountPaise: 5000000,
          description: "Initial Salary Deposit",
          status: "completed",
        },
        {
          accountId: primaryAccount._id,
          reference: "VB-TXN-TRANSFER-01",
          type: "transfer",
          category: "Transfer",
          amountPaise: 1500000,
          description: "Transfer to Sarah Smith",
          recipientDetails: "Sarah Smith (VB2004006001)",
          status: "completed",
        },
        {
          accountId: primaryAccount._id,
          reference: "VB-TXN-WITHDRAW-01",
          type: "withdrawal",
          category: "Withdrawal",
          amountPaise: 400000,
          description: "ATM Cash Withdrawal",
          status: "completed",
        },
      ]);
    }

    // Seed Fixed Deposit
    const fdCount = await FixedDeposit.countDocuments({ customerId: customer._id });
    if (fdCount === 0) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 2);
      const maturityDate = new Date(startDate);
      maturityDate.setMonth(maturityDate.getMonth() + 12);

      await FixedDeposit.create({
        customerId: customer._id,
        accountId: primaryAccount._id,
        depositNumber: "FD-VB-882910",
        amountPaise: 10000000, // ₹100,000
        tenureMonths: 12,
        interestRate: 7.5,
        maturityAmountPaise: 10750000, // ₹107,500
        startDate,
        maturityDate,
        status: "active",
      });
    }

    // Seed Loan
    const loanCount = await Loan.countDocuments({ customerId: customer._id });
    if (loanCount === 0) {
      await Loan.create({
        customerId: customer._id,
        accountId: primaryAccount._id,
        loanType: "Personal",
        amountPaise: 25000000, // ₹250,000
        interestRate: 10.5,
        tenureMonths: 24,
        emiPaise: 1159800, // ₹11,598
        remainingAmountPaise: 21500000,
        paidEmis: 3,
        purpose: "Home Interior Renovation",
        status: "approved",
        reviewedBy: staff._id,
        reviewNotes: "Credit score excellent (780). Approved with standard interest.",
      });

      // Also a pending loan for staff to review
      await Loan.create({
        customerId: sarah._id,
        accountId: sarahAccount._id,
        loanType: "Vehicle",
        amountPaise: 50000000, // ₹500,000
        interestRate: 8.75,
        tenureMonths: 36,
        emiPaise: 1584000, // ₹15,840
        remainingAmountPaise: 50000000,
        paidEmis: 0,
        purpose: "Electric Vehicle Purchase",
        status: "pending",
        reviewNotes: "Application submitted. Awaiting vehicle quotation documents.",
      });
    }

    // Seed Notifications
    const notifCount = await Notification.countDocuments({ customerId: customer._id });
    if (notifCount === 0) {
      await Notification.create([
        {
          customerId: customer._id,
          title: "Welcome to VaultBank",
          message: "Your premium account VB1002003001 is now active with full online banking access.",
          type: "system",
          read: true,
        },
        {
          customerId: customer._id,
          title: "Deposit Credited",
          message: "₹50,000.00 was credited to your Savings Account VB1002003001.",
          type: "transaction",
          read: false,
        },
        {
          customerId: customer._id,
          title: "Loan Approved",
          message: "Your Personal Loan application of ₹250,000.00 was approved by Bank Staff.",
          type: "loan",
          read: false,
        },
      ]);
    }

    // Seed Audit Log
    const auditCount = await AuditLog.countDocuments({});
    if (auditCount === 0) {
      await AuditLog.create([
        {
          userId: admin._id,
          userName: admin.name,
          userEmail: admin.email,
          userRole: "admin",
          action: "SYSTEM_INITIALIZE",
          details: "VaultBank core banking system initialized and security policies active.",
          severity: "info",
        },
        {
          userId: staff._id,
          userName: staff.name,
          userEmail: staff.email,
          userRole: "staff",
          action: "LOAN_APPROVED",
          details: "Approved Personal Loan application of ₹250,000 for customer Alexander Morgan.",
          severity: "info",
        },
      ]);
    }

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("Seeding error:", error);
  }
}
