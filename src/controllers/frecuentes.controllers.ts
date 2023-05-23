/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-empty-function */
import { CobrosFreq } from '@entitys/CobrosFreq'
import { Day } from '@entitys/Day'
import { Frecuentes } from '@entitys/Frecuentes'
import { Semanas } from '@entitys/Semanas'
import { User } from '@entitys/User'
import jwt from 'jsonwebtoken'

/* eslint-disable indent */
import moment, { Moment } from 'moment/moment.js'
import type { OkPacket, RowDataPacket } from 'mysql2'

import { SECRET } from '@config/config'
import { FORMATS, getSemStart } from '@utils/Dates'
import { isNumber } from '@utils/Numbers'
import { getPriorityColor } from '@utils/helpers'
import { DayRow } from '@utils/types/Day/controller'
import {
  COLORS_FREQ,
  Cobros_FreRow,
  Frecuente,
  FrecuenteRow,
  GastoFrecuente,
  LAPSES_TO_INT,
} from '@utils/types/Frecuentes/controller'
import { SemanasRow } from '@utils/types/Semanas/controller'
import { HandleRequest } from '@utils/types/helpers'

export const POST_freq: HandleRequest<GastoFrecuente> = async (req, res) => {
  try {
    const token = req.get('token')
    if (!token) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }
    const decodedUser = jwt.verify(token, SECRET) as User
    if (!decodedUser.usuId) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }

    const { name, amount, lapse, description, isStatic, date } = req.body
    if (
      !name ||
      !amount ||
      !lapse ||
      isStatic === undefined ||
      name.trim() === '' ||
      amount <= 0 ||
      lapse.trim() === ''
    ) {
      return res.status(400).json({ message: 'Datos incompletos' })
    }

    const Today = moment(date)
    if (!Today.isValid()) {
      return res.status(400).json({ message: 'Fecha no válida' })
    }
    const today = Today.format(FORMATS.SIMPLE_DATE)
    const startOfWeek = getSemStart().format(FORMATS.SIMPLE_DATE)

    const dayFound = await Day.findOne({
      relations: { semana: true },
      where: { dayDate: today, semana: { user: { usuId: decodedUser.usuId } } },
    })

    let todayEntity: Day | null = dayFound

    if (!dayFound) {
      const semanaFound = await Semanas.findOne({
        relations: { user: true },
        where: { semStart: startOfWeek, user: { usuId: decodedUser.usuId } },
      })

      if (!semanaFound) {
        const endOfWeek = Today.endOf('week').format(FORMATS.SIMPLE_DATE)
        const semanaCreated = await Semanas.create({
          semStart: startOfWeek,
          semEnd: endOfWeek,
          user: { usuId: decodedUser.usuId },
        })

        const insertSemanas = await semanaCreated.save()

        const dayCreated = Day.create({
          dayDate: today,
          semana: insertSemanas,
        })

        todayEntity = await dayCreated.save()

      } else {
        const dayCreated = Day.create({
          dayDate: today,
          semana: semanaFound,
        })

        todayEntity = await dayCreated.save()

      }
    } else {
      todayEntity = dayFound
    }

    const freqCreated = Frecuentes.create({
      freName: name,
      freDescription: description,
      freAmount: amount,
      freLapse: lapse,
      freIsStatic: isStatic,
      day: todayEntity,
      user: { usuId: decodedUser.usuId },
    })

    const insertFreq = await freqCreated.save()
    return res.status(201).json({
      message: 'Gasto creado',
      gasto: insertFreq,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error al crear el gasto' })
  }
}

export const GET_ALL_freq: HandleRequest = async (req, res) => {
  try {
    const token = req.get('token')
    if (!token) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }
    const decodedUser = jwt.verify(token, SECRET) as User
    if (!decodedUser.usuId) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }

    const frecuentesFound = await Frecuentes.find({
      relations: { day: true },
      where: { user: { usuId: decodedUser.usuId } },
    })

    const Day = moment()

    type TypeTemp = Partial<Frecuentes> & {
      nextCobDate: string
      daysTillNextCob: number
      priorityColor: COLORS_FREQ
    }
    const proximos: TypeTemp[] = []

    const notifications: string[] = []

    for (const freq of frecuentesFound) {
      let lastCobDate: string = freq.day.dayDate
      const cobroFound = await CobrosFreq.findOne({
        where: { frecuente: { freId: freq.freId } },
        order: { cobDate: 'DESC' },
      })
      if (cobroFound) {
        lastCobDate = cobroFound.cobDate
      }
      const lastCobDay = moment(lastCobDate)

      const nextCob = LAPSES_TO_INT[freq.freLapse](lastCobDay)
      const daysTillNextCob = nextCob.diff(Day, 'days') + 1
      if (daysTillNextCob <= 0) {
        const cobroCreated = CobrosFreq.create({
          cobDate: nextCob.format(FORMATS.SIMPLE_DATE),
          frecuente: { freId: freq.freId },
        })

        await cobroCreated.save()

        notifications.push(
          `Se ha cobrado ${freq.freName} por $${freq.freAmount}`
        )
      }

      const nextCobDate = nextCob.format(FORMATS.SIMPLE_DATE)

      const priorityColor = getPriorityColor(daysTillNextCob)

      proximos.push({
        ...freq,
        nextCobDate,
        daysTillNextCob,
        priorityColor,
      })
    }

    return res.status(200).json({
      message: 'Gastos frecuentes',
      frecuentes: frecuentesFound,
      proximos,
      notifications,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error al obtener los gastos' })
  }
}

export const GET_freq: HandleRequest<{}, { id?: string }> = async (
  req,
  res
) => {
  try {
    const { id } = req.params
    if (!id || !isNumber(id)) {
      return res.status(400).json({ message: 'Id no válido' })
    }

    const token = req.get('token')
    if (!token) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }
    const decodedUser = jwt.verify(token, SECRET) as User
    if (!decodedUser.usuId) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }

    const freqFound = await Frecuentes.findOne({
      relations: { day: true },
      where: { freId: id, user: { usuId: decodedUser.usuId } },
    })

    if (!freqFound) {
      return res.status(404).json({ message: 'Gasto frecuente no encontrado' })
    }

    return res
      .status(200)
      .json({ message: 'Gasto frecuente', gasto: freqFound })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error al obtener el gasto' })
  }
}

export const PUT_freq: HandleRequest<
  Partial<GastoFrecuente>,
  { id?: unknown }
> = async (req, res) => {
  try {
    const { id } = req.params
    if (!id || !isNumber(id)) {
      return res.status(400).json({ message: 'Id no válido' })
    }

    const { name, amount, lapse, description } = req.body
    if (
      !name &&
      !amount &&
      // !date &&
      !lapse
    ) {
      return res.status(400).json({ message: 'Sin datos' })
    }

    if (amount && !isNumber(amount))
      return res.status(400).json({ message: 'El monto debe ser un número' })

    if (lapse && lapse.trim() === '')
      return res.status(400).json({ message: 'El lapso no debe estar vacío' })

    if (name && name.trim() === '')
      return res.status(400).json({ message: 'El nombre no debe estar vacío' })

    const token = req.get('token')
    if (!token) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }
    const decodedUser = jwt.verify(token, SECRET) as User
    if (!decodedUser.usuId) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }

    const freqFound = await Frecuentes.findOne({
      where: { freId: id, user: { usuId: decodedUser.usuId } },
      relations: { day: true },
    })

    if (!freqFound) {
      return res.status(404).json({ message: 'Gasto frecuente no encontrado' })
    }

    if (name) {
      freqFound.freName = name
    }
    if (amount) {
      freqFound.freAmount = amount
    }
    if (lapse) {
      freqFound.freLapse = lapse
    }
    if (description) {
      freqFound.freDescription = description
    }

    console.log({ freqFound })

    await freqFound.save()

    return res
      .status(200)
      .json({ message: 'Gasto frecuente', gasto: freqFound })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error al obtener el gasto' })
  }
}

export const DELETE_freq: HandleRequest<{}, { id?: unknown }> = async (
  req,
  res
) => {
  try {
    const { id } = req.params
    if (!id || !isNumber(id)) {
      return res.status(400).json({ message: 'Id no válido' })
    }

    const token = req.get('token')
    if (!token) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }
    const decodedUser = jwt.verify(token, SECRET) as User
    if (!decodedUser.usuId) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }

    const removedFreq = await Frecuentes.createQueryBuilder('frecuentes')
      .delete()
      .from(Frecuentes)
      .where('freId = :id', { id })
      .execute()

    if (removedFreq.affected === 0) {
      return res.status(400).json({ message: 'Gasto no encontrado' })
    }

    return res
      .status(200)
      .json({ message: 'Gasto frecuente eliminado', ok: true })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error al eliminar el gasto' })
  }
}
