import { CobrosFreq } from '@entitys/CobrosFreq'
import { DataUser } from '@entitys/DataUser'
import { Day } from '@entitys/Day'
import { Diarios } from '@entitys/Diarios'
import { Frecuentes } from '@entitys/Frecuentes'
import { Ingresos } from '@entitys/Ingresos'
import { Notification } from '@entitys/Notification'
import { Semanas } from '@entitys/Semanas'
import { User } from '@entitys/User'
import { DataSource } from 'typeorm'
import { PlatformTools } from 'typeorm/platform/PlatformTools'

import {
  MYSQLDATABASE,
  MYSQLHOST,
  MYSQLPASSWORD,
  MYSQLPORT,
  MYSQLUSER,
} from '@config/config'

export const AppDataSource = new DataSource({
  type: 'mysql',
  driver: PlatformTools.load('mysql2'),
  host: MYSQLHOST,
  port: MYSQLPORT,
  username: MYSQLUSER,
  password: MYSQLPASSWORD,
  database: MYSQLDATABASE,
  entities: [
    User,
    DataUser,
    Semanas,
    Day,
    Diarios,
    Frecuentes,
    CobrosFreq,
    Ingresos,
    Notification,
  ],
  // logging: true,
  synchronize: true,
  // migrations: ['src/migrations/*.ts'],
  // migrationsTableName: 'migrations_bd_baro',
})
