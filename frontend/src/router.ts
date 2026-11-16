// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/puzzles/:game/how-to`
  | `/puzzles/:game/result/:recordId`
  | `/puzzles/:game/tutorial`
  | `/puzzles/bridges`
  | `/puzzles/bridges/play/:problemId`
  | `/puzzles/hakoiri-musume`
  | `/puzzles/hakoiri-musume/play/:problemId`
  | `/puzzles/hakoiri-musume/playtest/:problem`
  | `/puzzles/hitofude-puzzle`
  | `/puzzles/hitofude-puzzle/play/:problemId`
  | `/puzzles/ice-floor-maze`
  | `/puzzles/ice-floor-maze/play/:problemId`
  | `/puzzles/minesweeper`
  | `/puzzles/minesweeper/play/:problemId`
  | `/puzzles/nanpure`
  | `/puzzles/nanpure/play/:problemId`
  | `/puzzles/parking-jam`
  | `/puzzles/parking-jam/play/:problemId`
  | `/puzzles/reflection`
  | `/puzzles/reflection/play/:problemId`
  | `/puzzles/slide-puzzle`
  | `/puzzles/slide-puzzle/play/:problemId`
  | `/puzzles/takuzu`
  | `/puzzles/takuzu/play/:problemId`
  | `/puzzles/tsume-shogi`
  | `/puzzles/tsume-shogi/play/:problemId`
  | `/puzzles/water-sort`
  | `/puzzles/water-sort/play/:problemId`
  | `/records`

export type Params = {
  '/puzzles/:game/how-to': { game: string }
  '/puzzles/:game/result/:recordId': { game: string; recordId: string }
  '/puzzles/:game/tutorial': { game: string }
  '/puzzles/bridges/play/:problemId': { problemId: string }
  '/puzzles/hakoiri-musume/play/:problemId': { problemId: string }
  '/puzzles/hakoiri-musume/playtest/:problem': { problem: string }
  '/puzzles/hitofude-puzzle/play/:problemId': { problemId: string }
  '/puzzles/ice-floor-maze/play/:problemId': { problemId: string }
  '/puzzles/minesweeper/play/:problemId': { problemId: string }
  '/puzzles/nanpure/play/:problemId': { problemId: string }
  '/puzzles/parking-jam/play/:problemId': { problemId: string }
  '/puzzles/reflection/play/:problemId': { problemId: string }
  '/puzzles/slide-puzzle/play/:problemId': { problemId: string }
  '/puzzles/takuzu/play/:problemId': { problemId: string }
  '/puzzles/tsume-shogi/play/:problemId': { problemId: string }
  '/puzzles/water-sort/play/:problemId': { problemId: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
