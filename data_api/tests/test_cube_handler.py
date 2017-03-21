from bot.data import CubeHandler
import iris
from iris.tests import stock
from iris.coord_systems import GeogCS
import iris.coords as icoords

from numpy import ma
import numpy as np

import unittest
import datetime


class TestCubeHandler(unittest.TestCase):
    def setUp(self):
        # generate a fake cube
        data = np.arange(7 * 9 * 11).reshape((7, 9, 11))
        lat_pts = np.linspace(-4, 4, 9)
        lon_pts = np.linspace(-5, 5, 11)
        time_pts = np.linspace(394200, 394236, 7)
        forecast_period_pts = np.linspace(0, 36, 7)
        ll_cs = GeogCS(37.5, 177.5)

        lat = icoords.DimCoord(lat_pts, standard_name='projection_y_coordinate',
                               units='degrees', coord_system=ll_cs)
        lon = icoords.DimCoord(lon_pts, standard_name='projection_x_coordinate',
                               units='degrees', coord_system=ll_cs)
        time = icoords.DimCoord(time_pts, standard_name='time',
                                units='hours since 1970-01-01 00:00:00')
        cube = iris.cube.Cube(data, standard_name='air_potential_temperature',
                              units='K',
                              dim_coords_and_dims=[(time, 0), (lat, 1), (lon, 2)])
        self.handler = CubeHandler(cube)

    def test_times(self):
        expected_times = [394200]
        time_points = [datetime.datetime.fromtimestamp(expected_times[0] * 60 * 60)]

        new_cube = self.handler.times(time_points).cube
        new_times = new_cube.coord('time').points

        np.testing.assert_array_equal(new_times, expected_times)

    def test_multi_times(self):
        expected_times = [394200, 394206]
        time_points = list(map(lambda x: datetime.datetime.fromtimestamp(x * 60 * 60), expected_times))

        new_cube = self.handler.times(time_points).cube
        new_times = new_cube.coord('time').points

        np.testing.assert_array_equal(new_times, expected_times)

    def test_wrong_times(self):
        wrong_times = [394201]
        time_points = [datetime.datetime.fromtimestamp(wrong_times[0] * 60 * 60)]

        with self.assertRaises(ValueError):
            self.handler.times(time_points)



if __name__ == '__main__':
    unittest.main()
