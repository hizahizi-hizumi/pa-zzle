import pytest

from parking_jam_classic_audit import Model, analyze_problem


def board(vehicles, openings, fixed=(), width=4, height=4):
    return {
        "width": width,
        "height": height,
        "fixedAreas": list(fixed),
        "roadOpenings": list(openings),
        "vehicles": [{"id": f"v{i}", **vehicle} for i, vehicle in enumerate(vehicles)],
    }


def horizontal(row, column, length=2):
    return {"row": row, "column": column, "orientation": "horizontal", "length": length}


def vertical(row, column, length=2):
    return {"row": row, "column": column, "orientation": "vertical", "length": length}


def opening(side, offset):
    return {"side": side, "startOffset": offset, "length": 1}


def pool_row(problem_board):
    return {"level": 1, "problemId": "test", "board": problem_board}


@pytest.fixture
def wall_fixed_vehicle_board():
    return board(
        [horizontal(0, 0), vertical(0, 3)],
        [opening("right", 0), opening("down", 3)],
        fixed=[{"row": 3, "column": 3, "width": 1, "height": 1}],
    )


@pytest.fixture
def chain_row():
    # 横の車 A の右の進路を、下へ出る縦の車 b が塞ぐ。
    return pool_row(board([horizontal(1, 0), vertical(0, 3)], [opening("right", 1), opening("down", 3)]))


@pytest.fixture
def unexitable_row():
    # A は左にしか開口が無く、その進路を固定物が塞ぐ。
    return pool_row(
        board(
            [horizontal(1, 2)],
            [opening("left", 1)],
            fixed=[{"row": 1, "column": 0, "width": 1, "height": 1}],
        )
    )


def test_出庫の可否を開口なし固定物遮断車に分けること(wall_fixed_vehicle_board):
    model = Model(wall_fixed_vehicle_board)

    assert model.exits[0] == [("left", "wall", 0), ("right", "open", 0b10)]
    assert model.exits[1] == [("up", "wall", 0), ("down", "fixed", 0)]


class TestAnalyzeProblem:
    def test_遮断の連鎖を段数に数え詰みと判断局面を0にすること(self, chain_row):
        result = analyze_problem(chain_row)

        assert result["layers"] == [1, 1]
        assert (result["deadStates"], result["judgmentStates"], result["monotonicityViolations"]) == (0, 0, 0)
        assert result["randomSingleLegalSteps"] == 2

    def test_出られる車が無い局面を詰みに数えること(self, unexitable_row):
        result = analyze_problem(unexitable_row)

        assert result["deadStates"] == 1
