// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/puzzles/:game/result/:recordId`
  | `/puzzles/minesweeper`
  | `/puzzles/minesweeper/play/:difficulty`
  | `/puzzles/nanpure`
  | `/puzzles/nanpure/play/:difficulty`
  | `/puzzles/parking-jam`
  | `/puzzles/parking-jam/play/:difficulty`
  | `/puzzles/reflection`
  | `/puzzles/reflection/play/:difficulty`
  | `/puzzles/slide-puzzle`
  | `/puzzles/slide-puzzle/play/:difficulty`
  | `/puzzles/takuzu`
  | `/puzzles/takuzu/play/:difficulty`
  | `/puzzles/tsume-shogi/play/:difficulty`
  | `/puzzles/water-sort`
  | `/puzzles/water-sort/play/:difficulty`
  | `/records`

export type Params = {
  '/puzzles/:game/result/:recordId': { game: string; recordId: string }
  '/puzzles/minesweeper/play/:difficulty': { difficulty: string }
  '/puzzles/nanpure/play/:difficulty': { difficulty: string }
  '/puzzles/parking-jam/play/:difficulty': { difficulty: string }
  '/puzzles/reflection/play/:difficulty': { difficulty: string }
  '/puzzles/slide-puzzle/play/:difficulty': { difficulty: string }
  '/puzzles/takuzu/play/:difficulty': { difficulty: string }
  '/puzzles/tsume-shogi/play/:difficulty': { difficulty: string }
  '/puzzles/water-sort/play/:difficulty': { difficulty: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
