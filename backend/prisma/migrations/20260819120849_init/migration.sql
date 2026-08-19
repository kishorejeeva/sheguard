-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WEARER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'COUNTDOWN', 'STOPPED', 'ESCALATED', 'ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('EMERGENCY_CONTACT', 'GUARDIAN', 'POLICE_STATION', 'POLICE_HEADQUARTERS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "wearerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BluetoothDevice" (
    "id" TEXT NOT NULL,
    "wearerId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceIdentifier" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),

    CONSTRAINT "BluetoothDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "wearerId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianLocation" (
    "guardianId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GuardianLocation_pkey" PRIMARY KEY ("guardianId")
);

-- CreateTable
CREATE TABLE "VoiceSetting" (
    "id" TEXT NOT NULL,
    "wearerId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "keyword" TEXT NOT NULL DEFAULT 'help me',
    "detectionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "wearerId" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "escalationStartedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLocationLog" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLocationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRecipient" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL,
    "recipientId" TEXT,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "AlertRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliceStation" (
    "id" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PoliceStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "EmergencyContact_wearerId_idx" ON "EmergencyContact"("wearerId");

-- CreateIndex
CREATE INDEX "BluetoothDevice_wearerId_idx" ON "BluetoothDevice"("wearerId");

-- CreateIndex
CREATE INDEX "Location_wearerId_timestamp_idx" ON "Location"("wearerId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSetting_wearerId_key" ON "VoiceSetting"("wearerId");

-- CreateIndex
CREATE INDEX "Alert_wearerId_status_idx" ON "Alert"("wearerId", "status");

-- CreateIndex
CREATE INDEX "AlertLocationLog_alertId_timestamp_idx" ON "AlertLocationLog"("alertId", "timestamp");

-- CreateIndex
CREATE INDEX "AlertRecipient_alertId_idx" ON "AlertRecipient"("alertId");

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_wearerId_fkey" FOREIGN KEY ("wearerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BluetoothDevice" ADD CONSTRAINT "BluetoothDevice_wearerId_fkey" FOREIGN KEY ("wearerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_wearerId_fkey" FOREIGN KEY ("wearerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianLocation" ADD CONSTRAINT "GuardianLocation_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSetting" ADD CONSTRAINT "VoiceSetting_wearerId_fkey" FOREIGN KEY ("wearerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_wearerId_fkey" FOREIGN KEY ("wearerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLocationLog" ADD CONSTRAINT "AlertLocationLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecipient" ADD CONSTRAINT "AlertRecipient_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
