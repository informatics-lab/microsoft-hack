import cartopy
import iris


class CubeHandler(object):
    def __init__(self, cube):
        self.cube = cube

    @property
    def crs(self):
        return self.cube.coord_system().as_cartopy_crs()

    @property
    def time_units(self):
        return self.cube.coord('time').units

    @property
    def data(self):
        return self.cube.data

    def mean(self, coord):
        new_cube = self.cube.collapsed(coord, iris.analysis.MEAN)
        return self.__class__(new_cube)

    def extract_coord(self, constraint):
        new_cube = self.cube.extract(constraint)
        return self.__class__(new_cube)

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

    def times(self, times):
        values = [self.time_units.date2num(time) for time in times]
        print(values)
        time_constraint = iris.Constraint(time=values)
        return self.extract_coord(time_constraint)
