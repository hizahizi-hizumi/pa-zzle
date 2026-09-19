// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/games/nanpure`
  | `/games/nanpure/play/:difficulty`
  | `/games/water-sort`
  | `/games/water-sort/play/:difficulty`
  | `/records`

export type Params = {
  '/games/nanpure/play/:difficulty': { difficulty: string }
  '/games/water-sort/play/:difficulty': { difficulty: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
