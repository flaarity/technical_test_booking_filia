-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WORKER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('ONSITE', 'ONLINE');

-- CreateTable
CREATE TABLE "workers" (
    "id" SERIAL NOT NULL,
    "worker_code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "photo_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "clerk_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'ONSITE',
    "capacity" INTEGER NOT NULL,
    "building" VARCHAR(50),
    "floor" INTEGER,
    "location" VARCHAR(100),
    "facilities" TEXT[],
    "image" VARCHAR(255),
    "notes" VARCHAR(200),
    "open_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "close_time" VARCHAR(5) NOT NULL DEFAULT '21:00',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "room_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "worker_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "participants" INTEGER NOT NULL,
    "description" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workers_worker_code_key" ON "workers"("worker_code");

-- CreateIndex
CREATE UNIQUE INDEX "workers_email_key" ON "workers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workers_clerk_user_id_key" ON "workers"("clerk_user_id");

-- CreateIndex
CREATE INDEX "slots_room_id_idx" ON "slots"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "slots_room_id_start_time_key" ON "slots"("room_id", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_room_id_date_idx" ON "bookings"("room_id", "date");

-- CreateIndex
CREATE INDEX "bookings_worker_id_idx" ON "bookings"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_slots_slot_id_date_key" ON "booking_slots"("slot_id", "date");

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
