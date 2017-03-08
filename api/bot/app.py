from flask import Flask, request, jsonify
import datetime
from bot.data import Parameter, Parameters, expand_range, expand_years, date_inputs, CubeHandler
import iris

app = Flask(__name__)

DATA_PATH = ''
START = datetime.datetime(1960, 1, 1)


@app.route("/")
def hello():
    return "Hello, World!"


@app.route("/<parameter>/<operation>/climatology")
def climate(parameter, operation):
    start_input = request.args.get('start_date', None)
    end_input = request.args.get('end_date', None)
    date_input = request.args.get('date', None)
    lon = request.args.get('lon')
    lat = request.args.get('lat')

    if start_input is None and end_input is None and date_input is None:
        start_date, end_date = date_inputs(date=datetime.datetime.now())
    else:
        start_date, end_date = date_inputs(date_input, start_input, end_input)

    all_days = expand_range(start_date, end_date)
    all_years = expand_years(all_days, 20)

    return process_cube(all_years, parameter, lon, lat)


@app.route("/<parameter>/<operation>/range")
def ranges(parameter, operation):
    start_input = request.args.get('start_date', None)
    end_input = request.args.get('end_date', None)
    date_input = request.args.get('date', None)
    lon = request.args.get('lon')
    lat = request.args.get('lat')

    start_date, end_date = date_inputs(date_input, start_input, end_input)
    all_days = expand_range(start_date, end_date)

    return process_cube(all_days, parameter, lon, lat)


def process_cube(timestamps, parameter, lon, lat):
    data = load_param(parameter)
    handler = CubeHandler(data)
    result = handler.times(timestamps).point(lon, lat).mean('time')
    return jsonify(str(result.data))


def load_param(param):
    parameters = Parameters(DATA_PATH)
    parameter = parameters.get(param)
    return parameter.load()


def extract_times(cube, times):
    time_units = cube.coord('time').units
    timestamps = [time_units.date2num(time) for time in times]
    constraint = iris.Constraint(time=timestamps)
    return cube.extract(constraint)


if __name__ == "__main__":
    app.run(debug=True)
