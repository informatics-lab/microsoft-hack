import datetime
from typing import Sequence

import cartopy
import iris
import numpy as np


class CubeHandler(object):
    def __init__(self, cube):
        self.cube = cube
        self.operations = {
            'min': self.min,
            'max': self.max,
            'mean': self.mean
        }

    def _new(self, cube):
        if cube is None:
            raise ValueError('Result of operation is None')
        else:
            return self.__class__(cube)

    @property
    def crs(self):
        return self.cube.coord_system().as_cartopy_crs()

    @property
    def time_units(self):
        return self.cube.coord('time').units

    @property
    def data(self):
        return self.cube.data

    def mean(self, coord='time'):
        new_cube = self.cube.collapsed(coord, iris.analysis.MEAN)
        return self._new(new_cube)

    def min(self):
        # I can't find any good way in Iris to find the
        # coordinates of the max / min valued grid point.
        # 'Collapsing' a coordinate like with mean finds the
        # correct value but not the coordinates.
        min_slice = self.cube[np.argmin(self.cube.data)]
        return self._new(min_slice)

    def max(self):
        max_slice = self.cube[np.argmax(self.cube.data)]
        return self._new(max_slice)

    def extract_coord(self, constraint):
        new_cube = self.cube.extract(constraint)
        return self._new(new_cube)

    def grid(self, min_lon, max_lon, min_lat, max_lat,
             given_crs=cartopy.crs.PlateCarree()):
        x0, y0 = self.crs.transform_point(float(min_lon), float(min_lat), given_crs)
        x1, y1 = self.crs.transform_point(float(max_lon), float(max_lat), given_crs)

        x_coord = self.cube.coord('projection_x_coordinate')
        y_coord = self.cube.coord('projection_y_coordinate')

        min_x_index = x_coord.nearest_neighbour_index(x0)
        max_x_index = x_coord.nearest_neighbour_index(x1)

        min_y_index = y_coord.nearest_neighbour_index(y0)
        max_y_index = y_coord.nearest_neighbour_index(y1)

        x_constraint = iris.Constraint(
            projection_x_coordinate=x_coord.points[min_x_index:max_x_index + 1]
        )

        y_constraint = iris.Constraint(
            projection_y_coordinate=y_coord.points[min_y_index:max_y_index + 1]
        )

        return self.extract_coord(x_constraint).extract_coord(y_constraint)

    def point(self, lon, lat, given_crs=cartopy.crs.PlateCarree()):
        return self.grid(lon, lon, lat, lat, given_crs)

    def times(self, times: Sequence[datetime.datetime]):
        values = [self.time_units.date2num(time) for time in times]
        time_constraint = iris.Constraint(time=values)
        return self.extract_coord(time_constraint)
