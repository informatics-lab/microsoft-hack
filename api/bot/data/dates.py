import datetime
from collections import Iterable

from dateutil.relativedelta import relativedelta


def expand_years(dates, years):
    """
    Expand dates by a number of years (inclusive).

    E.g. expand_years(<2017, 1, 1>, 10) -> [<2007, 1, 1> ... <2017, 1, 1>]
    """
    if not isinstance(dates, Iterable):
        dates = [dates]

    result = []
    for d in dates:
        result.extend([d - relativedelta(years=i)
                       for i in range(years, -1, -1)])
    return sorted(result)


def expand_range(start, end):
    '''
    Return all days between a start and end point (inclusive)
    '''
    delta = end - start
    return [start + datetime.timedelta(days=i) for i in range(delta.days + 1)]
