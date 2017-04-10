import datetime
from collections import Iterable

from dateutil.relativedelta import relativedelta
from multipledispatch import dispatch


@dispatch((datetime.datetime, datetime.date), int)
def expand_years(dates, years):
    return expand_years([dates], years)


@dispatch(Iterable, int)
def expand_years(dates, years):
    """
    Expand dates by a number of years (inclusive).

    E.g. expand_years(<2017, 1, 1>, 10) -> [<2007, 1, 1> ... <2017, 1, 1>]
    """
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


def date_inputs(date=None, start_date=None, end_date=None,
                date_format='%Y-%m-%d', start='1960-1-1', end='2015-12-31'):
    def formatter(x):
        return datetime.datetime.strptime(x, date_format)

    if date:
        start = end = formatter(date)
    elif start_date and end_date:
        start = formatter(start_date)
        end = formatter(end_date)
    elif start_date and end_date is None:
        start = formatter(start_date)
        end = formatter(end)
    elif end_date and start_date is None:
        start = formatter(start)
        end = formatter(end_date)
    else:
        start = formatter(start)
        end = formatter(end)

    # Currently all of our data points are for midday
    start = start.replace(hour=12, minute=0, second=0, microsecond=0)
    end = end.replace(hour=12, minute=0, second=0, microsecond=0)

    return start, end
