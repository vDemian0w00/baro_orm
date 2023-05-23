import { DataUser } from '@entitys/DataUser'
import { Ingresos } from '@entitys/Ingresos'
import { User } from '@entitys/User'
import { getBalance } from '@services/user.services'
import jwt from 'jsonwebtoken'
import moment from 'moment'

import { SECRET } from '@config/config'
import { FORMATS } from '@utils/Dates'
import { UpdateIngresoBody } from '@utils/types/Ingresos'
import { HandleRequest } from '@utils/types/helpers'

export const getIngresos: HandleRequest = async (req, res) => {
  const token = req.get('token')
  if (!token || token === '') {
    return res.status(400).json({ message: 'Token de acceso no válido' })
  }
  const decodedUser = jwt.verify(token, SECRET) as User
  if (!decodedUser.usuId) {
    return res.status(400).json({ message: 'Token de acceso no válido' })
  }

  const ingresosFoun = await Ingresos.find({
    where: { user: { usuId: decodedUser.usuId } },
  })

  return res.status(200).json({
    message: 'Ingresos obtenidos correctamente',
    ingresos: ingresosFoun,
  })
}

export const updateIngreso: HandleRequest<UpdateIngresoBody> = async (
  req,
  res
) => {
  const { ingreso, desc, tipo } = req.body
  if (!ingreso || !desc || !tipo)
    return res.status(400).json({ message: 'Faltan datos' })
  if (parseFloat(ingreso) <= 0)
    return res.status(400).json({ message: 'Ingreso invalido' })

  try {
    const token = req.get('token')
    if (!token) return res.status(400).json({ message: 'No token' })
    const decodedUser = jwt.verify(token, SECRET) as User
    if (!decodedUser.usuId) {
      return res.status(400).json({ message: 'Token de acceso no válido' })
    }

    const Today = moment().format(FORMATS.SIMPLE_DATE)

    const [datBalance, err, userBD] = await getBalance(decodedUser.usuId)

    if (datBalance === undefined || userBD === undefined)
      return res.status(400).json({ message: err ?? 'Error' })

    const newBalance = datBalance + parseFloat(ingreso)

    const ingresoInsert = Ingresos.create({
      ingAmount: parseFloat(ingreso),
      ingDate: Today,
      ingType: tipo,
      ingDescription: desc,
      user: userBD,
    })

    await ingresoInsert.save()

    const updatedBalance = await DataUser.update(
      {
        datId: decodedUser.dataUser.datId,
      },
      {
        datBalance: newBalance,
      }
    )
    if (!updatedBalance.affected)
      return res.status(400).json({ message: 'Error al actualizar el balance' })

    return res.status(200).json({ message: 'Ingreso actualizado', newBalance })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error en el servidor' })
  }
}
