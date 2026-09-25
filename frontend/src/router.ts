// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/puzzles/minesweeper`
  | `/puzzles/minesweeper/play/:difficulty`
  | `/puzzles/nanpure`
  | `/puzzles/nanpure/play/:difficulty`
  | `/puzzles/water-sort`
  | `/puzzles/water-sort/play/:difficulty`
  | `/records`
  | `/records/replay/:recordId`

export type Params = {
  '/puzzles/minesweeper/play/:difficulty': { difficulty: string }
  '/puzzles/nanpure/play/:difficulty': { difficulty: string }
  '/puzzles/water-sort/play/:difficulty': { difficulty: string }
  '/records/replay/:recordId': { recordId: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
