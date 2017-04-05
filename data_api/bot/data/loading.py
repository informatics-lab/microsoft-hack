import glob

import iris
from braceexpand import braceexpand
from multipledispatch import dispatch


class Parameter(object):
    def __init__(self, name, data_path):
        self.name = name
        self.data_path = data_path

    def _load(self, filenames):
        cubes = iris.load(filenames)
        return cubes.concatenate_cube()

    @dispatch()
    def load(self):
        filenames = '{}/*'.format(self.data_path)
        return self._load(filenames)

    @dispatch(str)
    def load(self, pattern):
        potential_filenames = braceexpand('{}/*{}*'.format(self.data_path, pattern))
        filenames = list(map(lambda x: glob.glob(x), potential_filenames))
        flat_filenames = [f for filename in filenames for f in filename]

        return self._load(flat_filenames)


class Parameters(object):
    '''
    Find parameters by filename
    '''

    def __init__(self, data_path):
        self.data_path = data_path

    @property
    def paths(self):
        return glob.glob('{}/*'.format(self.data_path))

    @property
    def names(self):
        return [path.split('/')[-1] for path in self.paths]

    def get(self, name):
        path = next(filter(lambda x: name in x, self.paths))
        return Parameter(name, path)
