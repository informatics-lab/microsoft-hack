import datetime
import io
import uuid

import iris
import boto3
from flask import Flask, request, jsonify
import holoviews as hv
import geoviews as gv

from bot.data import Parameters, expand_range, expand_years, date_inputs, CubeHandler
from bot.settings import DATA_PATH

app = Flask(__name__)


@app.route("/<parameter>/<operation>/climatology")
def climate(parameter, operation):
    start_input = request.args.get('start_date', None)
    end_input = request.args.get('end_date', None)
    date_input = request.args.get('date', None)
    lon = request.args.get('lon', None)
    lat = request.args.get('lat', None)

    if lon is None or lat is None:
        raise ValueError('Please provide lon and lat')

    if start_input is None and end_input is None and date_input is None:
        date_input = datetime.datetime.strftime(
            datetime.datetime.now(), '%Y-%m-%d')

    start_date, end_date = date_inputs(date_input, start_input, end_input)

    all_days = expand_range(start_date, end_date)
    all_years = expand_years(all_days, 20)

    return process_cube(all_years, parameter, lon, lat, operation)


@app.route("/<parameter>/<operation>/range")
def ranges(parameter, operation):
    start_input = request.args.get('start_date', None)
    end_input = request.args.get('end_date', None)
    date_input = request.args.get('date', None)
    lon = request.args.get('lon', None)
    lat = request.args.get('lat', None)

    if lon is None or lat is None:
        raise ValueError('Please provide lon and lat')

    start_date, end_date = date_inputs(date_input, start_input, end_input)
    all_days = expand_range(start_date, end_date)

    return process_cube(all_days, parameter, lon, lat, operation)


def process_cube(timestamps, parameter, lon, lat, op):
    years = list(set([str(timestamp.year) for timestamp in timestamps]))
    if len(years) == 1:
        pattern = years[0]
    else:
        pattern = '{' + ','.join(years) + '}'
    data = load_param(parameter, pattern)
    handler = CubeHandler(data)
    subset = handler.times(timestamps).point(lon, lat)

    graph_link = graph(subset.cube)

    result = subset.operations[op]()

    time_result = result.cube.coord('time')
    real_start_date = time_result.units.num2date(time_result.bounds[0][0])
    real_end_date = time_result.units.num2date(time_result.bounds[-1][-1])

    return jsonify({
        'value': str(result.cube.data),
        'start_date': datetime.datetime.strftime(real_start_date, '%Y-%m-%d'),
        'end_date': datetime.datetime.strftime(real_end_date, '%Y-%m-%d'),
        'graph': graph_link
    })


def load_param(param, pattern):
    parameters = Parameters(DATA_PATH)
    parameter = parameters.get(param)
    return parameter.load(pattern)


def extract_times(cube, times):
    time_units = cube.coord('time').units
    timestamps = [time_units.date2num(time) for time in times]
    constraint = iris.Constraint(time=timestamps)
    return cube.extract(constraint)


def graph(cube):
    title = cube.standard_name.title().replace('_', ' ')

    dataset = gv.Dataset(cube)
    plot = dataset.to(hv.Curve, label=title, group='')

    renderer = hv.Store.renderers['matplotlib']
    renderer.size = 200
    img_data = io.BytesIO()
    renderer.save(plot, img_data)
    img_data.seek(0)

    s3_url = upload_image(img_data)
    return s3_url


def upload_image(byte_data):
    bucket_name = 'microsoft-hack'
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(bucket_name)
    uid = str(uuid.uuid4())
    bucket.put_object(
        Body=byte_data,
        ContentType='image/png',
        Key='{}.png'.format(uid),
        ACL='public-read')

    return 'https://s3-eu-west-1.amazonaws.com/{}/{}.png'.format(bucket_name, uid)


if __name__ == "__main__":
    app.run('0.0.0.0')
