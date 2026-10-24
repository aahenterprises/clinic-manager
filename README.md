# AAH Clinic: Clinic Management System

A full-stack clinic management web app built by **AAH Enterprises**. It uses a real **SQL database (SQLite)** with its own **Node.js and Express backend** and a secure login system.

> This is a demo project. Do not store real patient data in it.

## Features

- Admin account created on first run, with passwords stored as bcrypt hashes
- Login sessions using secure HttpOnly cookies, plus a login attempt limit
- Dashboard with patients, today's appointments, scheduled and completed counts
- Patients: add, edit, delete and search
- Doctors: add and delete
- Appointments: book, complete, cancel, delete, search and filter by status or date
- **A doctor cannot be double booked.** The database itself blocks two appointments at the same date and time
- Loading logo animation and a responsive teal and coral design

## What this project teaches

- Database design with tables, primary keys and foreign keys
- `ON DELETE CASCADE`, so deleting a patient also removes their appointments
- A `UNIQUE` index to prevent double booking
- SQL `JOIN` to show patient and doctor names in appointments
- Parameterised queries (`?`) to prevent SQL injection
- REST API design with Express

## Built with

- Node.js and Express
- SQLite (better-sqlite3)
- bcryptjs for password hashing
- HTML5, CSS3 and JavaScript on the front end

## How to run

1. Install [Node.js](https://nodejs.org) (LTS version).
2. Download or clone this repository.
3. Open a terminal in the project folder and run:<img width="1246" height="310" alt="Screenshot 2026-10-23 231545" 
<img width="1246" height="310" <img width="1288" height="596" alt="Screenshot 2026-10-23 231228" src="https://github.com/user-attachments/assets/8f74044c-8b35-4dc3-b4ef-e724aa1a9556" />
<img width="1241" height="597" alt="Screenshot 2026-10-23 231345" src="https://github.com/user-attachments/assets/ca718377-e245-4712-be55-56bbdd8e1fca" />
<img width="1228" height="603" alt="Screenshot 2026-10-23 231446" src="https://github.com/user-attachments/assets/3f336781-4dee-40f7-bc77-79f46f628ea4" />
<img width="1247" height="509" alt="Screenshot 2026-10-23 231518" src="https://github.com/user-attachments/assets/53e192e6-66c4-4b85-a9a7-5601f4ec0223" />
alt="Screenshot 2026-10-23 231545" src="https://github.com/user-attachments/assets/df3b8cb9-9031-4ffc-9334-18fe6861d544" />
<img width="1246" height="508" alt="Screenshot 2026-10-23 231659" src="https://github.com/user-attachments/assets/649ff9e3-4f90-4639-8ebb-db52e92fb9a4" />
<img width="1069" height="309" alt="Screenshot 2026-10-23 231741" src="https://github.com/user-attachments/assets/413a7907-4808-404e-84e8-284e6db92865" />
<img width="1252" height="420" alt="Screenshot 2026-10-23 231914" src="https://github.com/user-attachments/assets/4d0f7325-5329-4f51-8085-4462b48c7f6b" />
<img width="1130" height="252" alt="Screenshot 2026-10-23 231935" src="https://github.com/user-attachments/assets/e3b94377-8980-4da2-9ece-ed6410f27ca8" />
<img width="1259" height="598" alt="Screenshot 2026-10-23 232408" src="https://github.com/user-attachments/assets/ec6b3640-4eb2-490b-b77e-4805336cf4cf" />
<img width="1243" height="506" alt="Screenshot 2026-10-23 232436" src="https://github.com/user-attachments/assets/9489b6eb-34dd-4824-8d5f-95a62df648c7" />
<img width="1129" height="385" alt="Screenshot 2026-10-23 232456" src="https://github.com/user-attachments/assets/1cccecaf-61bb-47dd-8040-ca7b5d4580fb" />
<img width="1240" height="496" alt="Screenshot 2026-10-23 232529" src="https://github.com/user-attachments/assets/a6f2bff9-6918-49fc-8416-7916e3f107b2" />
<img width="1120" height="385" alt="Screenshot 2026-10-23 232550" src="https://github.com/user-attachments/assets/db9c1923-b4c6-4477-8ff8-4aeb9b4e53d4" />
<img width="1237" height="420" alt="Screenshot 2026-10-23 232635" src="https://github.com/user-attachments/assets/eb8aae73-c42a-46f3-a5e5-a0879a843744" />
<img width="1105" height="308" alt="Screenshot 2026-10-23 232720" src="https://github.com/user-attachments/assets/22cd41fe-caeb-4635-8e37-a0dc517af0e9" />
